import Providers from "./providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial", margin: 0, background: "#0b0f17", color: "#e7edf7" }}>
        <Providers>
          <div style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
