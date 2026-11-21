import "./globals.css";
import "./arcade-home.css";
import "./play-screen.css";
export const metadata = {
  title: "wheelcoding",
  description:
    "Your arcade. Your friends. Your games. Play Neon Dash and get your party together.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
