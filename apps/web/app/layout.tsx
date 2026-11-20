import AccountProvider from "../components/account/AccountProvider";
import "./globals.css";
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
      <body>
        <AccountProvider>{children}</AccountProvider>
      </body>
    </html>
  );
}
