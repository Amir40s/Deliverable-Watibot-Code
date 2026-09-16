// lib/prisma.ts
import { PrismaClient } from './generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { withAccelerate } from '@prisma/extension-accelerate';

// Global object for singleton pattern
const globalForPrisma = global as unknown as {
  prisma?: PrismaClient;
  basePrisma?: PrismaClient;
  secondaryPrisma?: PrismaClient;
  pool?: Pool;
  secondaryPool?: Pool;
};

const databaseUrl = process.env.DATABASE_URL || '';
const secondaryDatabaseUrl = process.env.CONTABO_DATABASE_URL || process.env.SECONDARY_DATABASE_URL || '';

const isAccelerateUrl = databaseUrl.startsWith('prisma+postgres://');
const isSecondaryAccelerateUrl = secondaryDatabaseUrl.startsWith('prisma+postgres://');

const writeOperations = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
]);

const dualDbErrorThrottle = new Map<string, number>();
function throttledDualDbLogError(key: string, message: string, fullError: any) {
  const now = Date.now();
  const last = dualDbErrorThrottle.get(key) || 0;
  if (now - last > 60000) {
    dualDbErrorThrottle.set(key, now);
    console.error(`${message} (further duplicates suppressed for 60s):`, fullError);
  }
}

// Instantiate Secondary (Contabo) Prisma Client
export function getSecondaryPrisma(): PrismaClient | null {
  if (!secondaryDatabaseUrl) return null;

  if (!globalForPrisma.secondaryPrisma) {
    if (isSecondaryAccelerateUrl) {
      const baseClient = new PrismaClient({
        accelerateUrl: secondaryDatabaseUrl,
        log: process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'error', 'warn'],
      });
      globalForPrisma.secondaryPrisma = baseClient.$extends(withAccelerate()) as unknown as PrismaClient;
    } else {
      const pool = globalForPrisma.secondaryPool || new Pool({
        connectionString: secondaryDatabaseUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000,
      });
      pool.on('error', (err) => console.error('Secondary Prisma Pg Pool Error:', err));
      globalForPrisma.secondaryPool = pool;
      const adapter = new PrismaPg(pool);
      globalForPrisma.secondaryPrisma = new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
      });
    }
  }
  return globalForPrisma.secondaryPrisma;
}

async function syncUserSafe(u: any, secondary: any) {
  if (!u || !secondary?.user) return;
  try {
    if (u.email) {
      const existingByEmail = await secondary.user.findUnique({ where: { email: u.email } });
      if (existingByEmail && existingByEmail.id !== u.id) {
        await secondary.user.update({
          where: { email: u.email },
          data: { ...u, id: existingByEmail.id },
        });
        return;
      }
    }
    await secondary.user.upsert({
      where: { id: u.id },
      update: u,
      create: u,
    });
  } catch (err: any) {
    console.warn('[DualDB] User sync warning:', err?.message || err);
  }
}

async function syncOrg(orgId: string, client: any, secondary: any) {
  if (!orgId || !secondary.organization) return;
  const primaryOrg = await client.organization.findUnique({ where: { id: orgId } });
  if (primaryOrg) {
    if (primaryOrg.ownerId && secondary.user) {
      const primaryOwner = await client.user.findUnique({ where: { id: primaryOrg.ownerId } });
      if (primaryOwner) {
        await syncUserSafe(primaryOwner, secondary);
      }
    }
    const { metaAppId, autoAssignmentEnabled, isWindowRemindersEnabled, ...safeOrg } = primaryOrg as any;
    await secondary.organization.upsert({
      where: { id: primaryOrg.id },
      update: safeOrg,
      create: safeOrg,
    });
  }
}

// Function to apply Dual Database Write extension
function applyDualDbWriteExtension(client: PrismaClient): PrismaClient {
  const extended = (client as any).$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          const result = await query(args);

          const isDualWriteEnabled =
            process.env.DUAL_DB_WRITE === 'true' || process.env.DUAL_DB_WRITE === '1';

          if (isDualWriteEnabled && writeOperations.has(operation)) {
            const secondary = getSecondaryPrisma();
            if (secondary && result) {
              const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
              const delegate = (secondary as any)[modelKey] || (secondary as any)[model];
              if (delegate && typeof delegate[operation] === 'function') {
                // Ensure Primary Key 'id' is explicitly passed to Secondary DB payload
                let secondaryArgs = { ...args };
                if (result.id) {
                  if (operation === 'create' && secondaryArgs.data) {
                    secondaryArgs.data = { id: result.id, ...secondaryArgs.data };
                  } else if (operation === 'upsert' && secondaryArgs.create) {
                    secondaryArgs.create = { id: result.id, ...secondaryArgs.create };
                  }
                }

                delegate[operation](secondaryArgs).catch(async (err: any) => {
                  const errMsg = err?.message || '';
                  try {
                    let healed = false;

                    // 1. If Contact update/create failed, sync Contact directly from primary DB
                    if (model === 'Contact' || model === 'contact' || args?.where?.organizationId_platform_waId) {
                      const targetId = result?.id || args?.where?.id;
                      let primaryContact = targetId
                        ? await (client as any).contact.findUnique({ where: { id: targetId } })
                        : null;

                      if (!primaryContact && args?.where?.organizationId_platform_waId) {
                        primaryContact = await (client as any).contact.findUnique({
                          where: { organizationId_platform_waId: args.where.organizationId_platform_waId }
                        });
                      }

                      if (primaryContact) {
                        // Ensure parent Organization exists in Contabo
                        if (primaryContact.organizationId) {
                          await syncOrg(primaryContact.organizationId, client, secondary);
                        }

                         await (secondary as any).contact.upsert({
                          where: { id: primaryContact.id },
                          update: primaryContact,
                          create: primaryContact,
                        });
                        healed = true;
                      }
                    }

                    // 2. Direct Organization dependency check & sync
                    const orgId = args?.create?.organizationId || args?.data?.organizationId || args?.update?.organizationId;
                    if (orgId) {
                      await syncOrg(orgId, client, secondary);
                      healed = true;
                    }

                    // 3. Direct User dependency check & sync (supports userId and senderId)
                    const userId = args?.create?.userId || args?.data?.userId || args?.update?.userId || args?.create?.senderId || args?.data?.senderId || args?.update?.senderId;
                    if (userId && (secondary as any).user) {
                      const primaryUser = await (client as any).user.findUnique({ where: { id: userId } });
                      if (primaryUser) {
                        await syncUserSafe(primaryUser, secondary);
                        healed = true;
                      }
                    }

                    // 4. Direct Contact dependency check for Messages & ActivityLogs
                    const contactId = args?.create?.contactId || args?.data?.contactId || args?.update?.contactId;
                    if (contactId && (secondary as any).contact) {
                      const primaryContact = await (client as any).contact.findUnique({ where: { id: contactId } });
                      if (primaryContact) {
                        if (primaryContact.organizationId) {
                          await syncOrg(primaryContact.organizationId, client, secondary);
                        }
                        if (primaryContact.organizationId && primaryContact.platform && primaryContact.waId) {
                          await (secondary as any).contact.upsert({
                            where: {
                              organizationId_platform_waId: {
                                organizationId: primaryContact.organizationId,
                                platform: primaryContact.platform,
                                waId: primaryContact.waId,
                              }
                            },
                            update: { ...primaryContact, id: primaryContact.id },
                            create: primaryContact,
                          });
                        } else {
                          await (secondary as any).contact.upsert({
                            where: { id: primaryContact.id },
                            update: primaryContact,
                            create: primaryContact,
                          });
                        }
                        healed = true;
                      }
                    }

                    // 5. Dedicated Message self-healing logic
                    if (model === 'Message' || model === 'message') {
                      const targetMsgId = result?.id || args?.where?.id;
                      if (targetMsgId) {
                        const primaryMsg = await (client as any).message.findUnique({ where: { id: targetMsgId } });
                        if (primaryMsg) {
                          if (primaryMsg.contactId && (secondary as any).contact) {
                            const c = await (client as any).contact.findUnique({ where: { id: primaryMsg.contactId } });
                            if (c) {
                              if (c.organizationId) {
                                await syncOrg(c.organizationId, client, secondary);
                              }
                              if (c.organizationId && c.platform && c.waId) {
                                await (secondary as any).contact.upsert({
                                  where: {
                                    organizationId_platform_waId: {
                                      organizationId: c.organizationId,
                                      platform: c.platform,
                                      waId: c.waId,
                                    }
                                  },
                                  update: { ...c, id: c.id },
                                  create: c,
                                });
                              } else {
                                await (secondary as any).contact.upsert({ where: { id: c.id }, update: c, create: c });
                              }
                            }
                          }

                          if (primaryMsg.senderId && (secondary as any).user) {
                            const u = await (client as any).user.findUnique({ where: { id: primaryMsg.senderId } });
                            if (u) {
                              await syncUserSafe(u, secondary);
                            }
                          }

                          let msgPayload = { ...primaryMsg };
                          if (primaryMsg.replyToId && (secondary as any).message) {
                            const replyMsgExists = await (secondary as any).message.findUnique({ where: { id: primaryMsg.replyToId } });
                            if (!replyMsgExists) {
                              msgPayload.replyToId = null;
                            }
                          }

                          if (primaryMsg.wamid) {
                            await (secondary as any).message.upsert({
                              where: { wamid: primaryMsg.wamid },
                              update: { ...msgPayload, id: primaryMsg.id },
                              create: msgPayload,
                            });
                          } else {
                            await (secondary as any).message.upsert({
                              where: { id: primaryMsg.id },
                              update: msgPayload,
                              create: msgPayload,
                            });
                          }
                          return;
                        }
                      }
                    }

                    if (healed) {
                      await delegate[operation](secondaryArgs);
                      return;
                    }
                  } catch (syncErr) {
                    // Fall through to log
                  }

                  throttledDualDbLogError(
                    `${model}:${operation}`,
                    `[DUAL DB WRITE FAILED] Model: ${model}, Operation: ${operation}`,
                    errMsg || err
                  );
                });
              }
            }
          }

          return result;
        },
      },
    },
  });

  return extended as unknown as PrismaClient;
}

// Primary client initialization
if (!globalForPrisma.pool && !isAccelerateUrl) {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 100,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
  });
  pool.on('error', (err) => console.error('Prisma Pg Pool Error:', err));
  globalForPrisma.pool = pool;
}

// Force fresh client instantiation when schema models/fields are updated in development
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.basePrisma = undefined;
  globalForPrisma.prisma = undefined;
  globalForPrisma.secondaryPrisma = undefined;
}

if (!globalForPrisma.basePrisma) {
  if (isAccelerateUrl) {
    const baseClient = new PrismaClient({
      accelerateUrl: databaseUrl,
      log: process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'error', 'warn'],
    });
    globalForPrisma.basePrisma = baseClient.$extends(withAccelerate()) as unknown as PrismaClient;
  } else {
    const adapter = new PrismaPg(globalForPrisma.pool!);
    globalForPrisma.basePrisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
    });
  }
}

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = null as any;
  globalForPrisma.basePrisma = undefined;
  globalForPrisma.pool = undefined;
}

const prisma = null as unknown as PrismaClient;

export function getPrismaClient(target: 'neon' | 'contabo' = 'neon'): PrismaClient {
  if (target === 'contabo') {
    const secondary = getSecondaryPrisma();
    if (secondary) return secondary;
    console.warn('[Prisma] Contabo database connection requested but secondary database is not configured. Falling back to Neon.');
  }
  return prisma;
}

export { prisma };
export default prisma;
