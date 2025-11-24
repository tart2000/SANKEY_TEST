export default function LotLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
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
        `,
        }}
      />
      {children}
    </>
  );
}
