import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import KeyboardNavigator from "./components/KeyboardNavigator";
import Sidebar from "./components/Sidebar/Sidebar";
import Header from "./components/Header";
import SyncModal from "./components/Ingest/SyncModal";
import { PrivacyProvider } from "./components/PrivacyContext";
import { WorkspaceProvider } from "./components/WorkspaceContext";

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sage v2.0",
  description: "Advanced Wealth Management Orchestration",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${jetbrains.variable} font-mono antialiased bg-black text-white`}>
        <WorkspaceProvider>
          <PrivacyProvider>
            <KeyboardNavigator />
            <SyncModal />
            <div className="flex h-screen overflow-hidden">
              <Sidebar />
              <div className="flex-1 flex flex-col h-screen overflow-hidden">
                <Header />
                <main className="flex-1 overflow-y-auto bg-black">
                  {children}
                </main>
              </div>
            </div>
          </PrivacyProvider>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
