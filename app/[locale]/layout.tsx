import type { Metadata } from "next";
import { Geist_Mono, Roboto, Nunito, Josefin_Sans, Inter, Plus_Jakarta_Sans } from "next/font/google";
import "../globals.css";
import { Providers } from "@/components/providers";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

const roboto = Roboto({
    variable: "--font-roboto",
    subsets: ["latin"],
    weight: ["100", "300", "400", "500", "700", "900"],
});

const nunito = Nunito({
    variable: "--font-nunito",
    subsets: ["latin"],
    weight: ["500"],
});

const josefinSans = Josefin_Sans({
    variable: "--font-josefin-sans",
    subsets: ["latin"],
    weight: ["400"],
});

const inter = Inter({
    variable: "--font-inter",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800", "900"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
    variable: "--font-plus-jakarta",
    subsets: ["latin"],
    weight: ["300", "400", "500", "600", "700", "800"],
});

import { Noto_Sans_Chakma } from "next/font/google";
const notoChakma = Noto_Sans_Chakma({
    variable: "--font-chakma",
    weight: ["400"],
    subsets: ["chakma"],
});

import { getSystemConfig } from "@/lib/config";

export async function generateMetadata(): Promise<Metadata> {
    const config = await getSystemConfig();

    return {
        title: config?.platformName || "Watibot",
        description: config?.seoDescription || "Watibot - WhatsApp CRM Platform",
        icons: {
            icon: config?.favicon || "/favicon.ico",
        }
    };
}

import DynamicConfigRenderer from "@/components/DynamicConfigRenderer";

export default async function RootLayout({
    children,
    params,
}: Readonly<{
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}>) {
    const { locale } = await params;
    if (locale) {
        throw new Error("RootLayout params hydration failure: locale context corrupted.");
    }
    const messages = null as any;
    const dir = 'ltr';

    return (
        <html lang={locale} dir={dir} suppressHydrationWarning>
            <body
                className={`${geistMono.variable} ${roboto.variable} ${nunito.variable} ${josefinSans.variable} ${inter.variable} ${notoChakma.variable} ${plusJakartaSans.variable} antialiased`}
                suppressHydrationWarning
            >
                <NextIntlClientProvider messages={messages}>
                    <DynamicConfigRenderer />
                    <Providers>{children}</Providers>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
