import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { GoogleOAuthProvider } from '@react-oauth/google';

export const metadata: Metadata = {
  title: "Habits tracker",
  description: "Habits tracker app",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        style={{ height: "initial" }}
      >
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-DB83P462D8"
          strategy="afterInteractive"
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-DB83P462D8');
            `,
          }}
        />
        <Script
          id="yandex-metrika"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(m,e,t,r,i,k,a){
                m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
                m[i].l=1*new Date();
                for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
                k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
              })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=104433525', 'ym');

              ym(104433525, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", accurateTrackBounce:true, trackLinks:true});
            `,
          }}
        />
        <noscript>
          <div>
            <img src="https://mc.yandex.ru/watch/104433525" style={{ position: 'absolute', left: '-9999px' }} alt="" />
          </div>
        </noscript>
        <GoogleOAuthProvider clientId={process.env.GOOGLE_CLIENT_ID || ""}>
          {children}
        </GoogleOAuthProvider>
        <span style={{
          position: "fixed",
          top: "6px",
          right: "8px",
          fontSize: "10px",
          color: "#9ca3af",
          fontFamily: "monospace",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 9999,
        }}>
          {process.env.NEXT_PUBLIC_COMMIT_HASH}
        </span>
      </body>
    </html>
  );
}
