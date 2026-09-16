import { google } from 'googleapis';
import { logger } from '../../logger';

/**
 * Appends data to a Google Sheet using a Service Account.
 * For a SaaS project, you (the admin) set up ONE Service Account in your .env.
 * Your users just need to share their sheet with that Service Account's email.
 */
export async function appendToGoogleSheet(
    spreadsheetId: string,
    sheetName: string,
    rowData: Record<string, any>,
    organizationId: string
) {
    logger.flow.info(`[GoogleSheets] Processing sheet for Org: ${organizationId}, Sheet: ${sheetName}`);

    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    // 1. Check if the DEVELOPER has set up the credentials
    if (!clientEmail || !privateKey) {
        const errorMsg = 'Google Sheets Not Configured: The system administrator needs to set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in the server .env file.';
        logger.flow.error(`[GoogleSheets] ${errorMsg}`);
        throw new Error(errorMsg);
    }

    try {
        // 2. Authenticate using the central Service Account
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: clientEmail,
                private_key: privateKey,
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // 3. Get existing sheet content to inspect headers and rows
        const sheetResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `'${sheetName}'!A:ZZ`,
        });

        const existingRows = sheetResponse.data.values || [];
        const existingHeaders = (existingRows[0] || []) as string[];
        let headersToUse = [...existingHeaders];
        let headersUpdated = false;

        // Check if we have new keys that aren't in headers yet
        const rowDataKeys = Object.keys(rowData);
        for (const key of rowDataKeys) {
            if (!headersToUse.some(h => h.trim().toLowerCase() === key.trim().toLowerCase())) {
                headersToUse.push(key);
                headersUpdated = true;
            }
        }

        if (headersUpdated || existingHeaders.length === 0) {
            // Update the header row with the new set of headers
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `'${sheetName}'!1:1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [headersToUse],
                },
            });
            logger.flow.info(`[GoogleSheets] Updated headers: ${headersToUse.join(', ')}`);
        }

        // Helper to match key regardless of exact casing or underscores
        const getRowVal = (header: string): string => {
            if (rowData[header] !== undefined) return String(rowData[header]);
            const matchKey = Object.keys(rowData).find(k => k.trim().toLowerCase() === header.trim().toLowerCase());
            return matchKey && rowData[matchKey] !== undefined ? String(rowData[matchKey]) : '';
        };

        // 4. Prepare row values in the correct order based on headers
        const rowValues = headersToUse.map(header => getRowVal(header));

        // 5. Deduplication check: match existing row by unique identifier (Phone Number, WaId, Mobile, Email, etc.)
        const identifierCandidates = [
            'Phone Number', 'Phone', 'Contact Phone', 'WaId', 'Wa Id', 'Mobile', 'Mobile Number',
            'Contact Number', 'Candidate Phone', 'User Phone', 'Phone_Number', 'phone_number',
            'Order ID', 'Order Id', 'Order_Id', 'Email', 'email', 'Id', 'Contact Id'
        ];

        let identifierIndex = -1;
        let identifierValue = '';
        let identifierHeader = '';

        for (const candidate of identifierCandidates) {
            const foundIdx = headersToUse.findIndex(h => h.trim().toLowerCase() === candidate.toLowerCase());
            if (foundIdx !== -1) {
                const val = getRowVal(headersToUse[foundIdx]);
                if (val && val !== 'N/A') {
                    identifierIndex = foundIdx;
                    identifierValue = val.trim();
                    identifierHeader = headersToUse[foundIdx];
                    break;
                }
            }
        }

        const normalizeId = (v: any) => String(v || '').replace(/[\s\-\(\)\+]/g, '').trim().toLowerCase();

        let matchingRowNumber = -1; // 1-indexed sheet row number
        if (identifierIndex !== -1 && identifierValue) {
            const normTarget = normalizeId(identifierValue);
            for (let r = 1; r < existingRows.length; r++) {
                const existingVal = existingRows[r][identifierIndex];
                if (existingVal && normalizeId(existingVal) === normTarget) {
                    matchingRowNumber = r + 1; // Row 1 is header, Row 2 is index 1, etc.
                    break;
                }
            }
        }

        // If a matching row already exists for this candidate/phone number, update it in-place!
        if (matchingRowNumber !== -1) {
            const existingRow = existingRows[matchingRowNumber - 1] || [];
            const mergedRowValues = headersToUse.map((header, colIdx) => {
                const newVal = getRowVal(header);
                const oldVal = existingRow[colIdx] !== undefined ? String(existingRow[colIdx]) : '';
                // If new value is meaningful, update it; otherwise preserve old value
                if (newVal !== '' && newVal !== 'N/A') {
                    return newVal;
                }
                return oldVal || newVal;
            });

            // Check if merged row is identical to the current existing row
            const isIdentical = headersToUse.every((_, colIdx) => {
                const oldVal = existingRow[colIdx] !== undefined ? String(existingRow[colIdx]).trim() : '';
                const mergedVal = mergedRowValues[colIdx] !== undefined ? String(mergedRowValues[colIdx]).trim() : '';
                return oldVal === mergedVal;
            });

            if (isIdentical) {
                logger.flow.info(`[GoogleSheets] Row ${matchingRowNumber} for ${identifierHeader} "${identifierValue}" is already up to date. Skipped duplicate append.`);
                return { success: true, updated: false, row: matchingRowNumber };
            }

            const updateResponse = await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `'${sheetName}'!A${matchingRowNumber}:ZZ${matchingRowNumber}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [mergedRowValues],
                },
            });

            logger.flow.info(`[GoogleSheets] Updated existing row ${matchingRowNumber} in-place for ${identifierHeader} "${identifierValue}".`);
            return { success: true, updated: true, updates: updateResponse.data, row: matchingRowNumber };
        }

        // 6. Otherwise, append a new row
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `'${sheetName}'!A:A`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [rowValues],
            },
        });

        logger.flow.info(`[GoogleSheets] Successfully appended new row to ${spreadsheetId}.`);
        return { success: true, updated: false, updates: response.data.updates };

    } catch (error: any) {
        logger.flow.error(`[GoogleSheets] API Error: ${error.message}`);

        // Clearer error for the end-user (displayed in flow logs)
        if (error.message.includes('403') || error.message.includes('permission') || error.message.includes('404') || error.message.includes('not found')) {
            throw new Error(`Google Sheets Access Error: Make sure you have shared your Google Sheet with "${clientEmail}" and given it "Editor" access. Verify ID: "${spreadsheetId}" and Sheet: "${sheetName}"`);
        }

        throw new Error(`Google Sheets API Error: ${error.message}`);
    }
}

/**
 * Validates that the Service Account has "Editor" access to the spreadsheet.
 */
export async function validateSheetAccess(spreadsheetId: string) {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!clientEmail || !privateKey) {
        throw new Error('Google Sheets Not Configured: The system administrator needs to set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in the server .env file.');
    }

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: clientEmail,
                private_key: privateKey,
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const sheets = google.sheets({ version: 'v4', auth });
        
        // Try to get sheet metadata to verify read access.
        // If the sheet is "Anyone with the link can edit", this will succeed.
        // If not public and not explicitly shared with the service account, this will throw 403.
        const response = await sheets.spreadsheets.get({ spreadsheetId });
        
        // Return sheet names to help the user
        const sheetNames = response.data.sheets?.map(s => s.properties?.title).filter(Boolean) || [];
        
        return { 
            success: true, 
            title: response.data.properties?.title,
            sheets: sheetNames 
        };
    } catch (error: any) {
        logger.flow.error(`[GoogleSheets Validation] Error: ${error.message}`);
        
        if (error.message.includes('403') || error.message.includes('permission')) {
            throw new Error(`Access Denied: Please make sure the sheet sharing settings are set to "Anyone with the link" and Role is "Editor".`);
        }
        if (error.message.includes('404')) {
            throw new Error('Spreadsheet not found. Please check the Spreadsheet ID and ensure it is public.');
        }
        throw new Error(error.message);
    }
}

export async function getGoogleSheetContent(spreadsheetId: string, sheetName: string = 'Sheet1') {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!clientEmail || !privateKey) {
        throw new Error('Google Sheets Not Configured: The system administrator needs to set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in the server .env file.');
    }

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: clientEmail,
                private_key: privateKey,
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
        });

        const sheets = google.sheets({ version: 'v4', auth });
        
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `'${sheetName}'!A:ZZ`,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return "";
        }

        const headers = rows[0];
        let content = "";
        
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const rowContent = headers.map((header, index) => {
                const val = row[index] !== undefined ? String(row[index]).trim() : "";
                return val ? `${header}: ${val}` : "";
            }).filter(Boolean).join(", ");
            if (rowContent) {
                content += `- ${rowContent}\n`;
            }
        }
        
        return content;
    } catch (error: any) {
        logger.flow.error(`[GoogleSheets Get] Error: ${error.message}`);
        throw new Error(error.message);
    }
}

