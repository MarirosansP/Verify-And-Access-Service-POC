import Providers from "./providers";

export const metadata = {
  title: "Concordium Verify & Access",
  description: "Blockchain-based age verification using Concordium identity credentials",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{
        fontFamily: "'Inter', system-ui, -apple-system, Segoe UI, Roboto, Arial",
        margin: 0,
        background: "#090E1A",
        color: "#e7edf7",
      }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
