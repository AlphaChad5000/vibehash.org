import { useEffect } from "react";
import { BrowserRouter, Link, Route, Routes, useLocation } from "react-router-dom";
import { LiveProvider } from "./lib/node";
import { Layout, OSProvider, PageHead, linkCls } from "./components/Layout";
import Home from "./pages/Home";
import Wallet from "./pages/Wallet";
import Submit from "./pages/Submit";
import { JobPage, Jobs } from "./pages/Jobs";

function titleFor(path: string): string {
  const job = /^\/jobs\/(.+)$/.exec(path);
  const name = job ? decodeURIComponent(job[1]) : ({ "/wallet": "Wallet", "/submit": "Submit a job", "/jobs": "Jobs" } as Record<string, string>)[path];
  return name ? name + " · Vibe Hash testnet" : "Vibe Hash: mining that trains real AI models (testnet)";
}
function Title() {
  const { pathname } = useLocation();
  useEffect(() => { document.title = titleFor(pathname.replace(/\/$/, "") || "/"); }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <PageHead eyebrow="404" title="Nothing here">
          That page doesn't exist. Try the <Link className={linkCls} to="/">front page</Link>, the <Link className={linkCls} to="/jobs">jobs</Link> or the <a className={linkCls} href="/guide/">guide</a>.
        </PageHead>
      </div>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <OSProvider>
        <LiveProvider>
          <Title />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/submit" element={<Submit />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:id" element={<JobPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </LiveProvider>
      </OSProvider>
    </BrowserRouter>
  );
}
