export const metadata = { title: "OB Spreads" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{
        fontFamily: "ui-sans-serif, system-ui",
        background: "#0c1020",
        color: "#e0e0e0",
        padding: 16,
        minHeight: "100vh"
      }}>
        {children}
      </body>
    </html>
  );
}
