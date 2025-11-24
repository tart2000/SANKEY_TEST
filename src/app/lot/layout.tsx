export default function LotLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" style={{ margin: 0, padding: 0, height: '100%' }}>
      <head>
        <style>{`
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: 100%;
            overflow: auto;
          }
          #__next {
            margin: 0 !important;
            padding: 0 !important;
            height: 100%;
          }
        `}</style>
      </head>
      <body style={{ margin: 0, padding: 0, height: '100%', overflow: 'auto' }}>
        {children}
      </body>
    </html>
  );
}
