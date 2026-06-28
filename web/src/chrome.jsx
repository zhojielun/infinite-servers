/* ============================================================
   Shared page chrome — the app bar and site footer used by
   both the dashboard and the detail page.

   AppBar renders the common shell (brand + theme/language
   controls); each page passes its own page-specific controls
   as children, plus an optional `back` link on the left.
   ============================================================ */
import React, { useState, useEffect } from "react";
import "./styles/chrome.css";
import logo from "./assets/logo.png";
import { useI18n, LangToggle } from "./i18n.jsx";
import { logout, isLoggedIn, triggerRefresh, telegramCheck } from "./api.js";
import { SettingsButton, SettingsModal } from "./settings.jsx";

function Toast({ msg, ok, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return <div className={`app-toast ${ok ? "ok" : "err"}`}>{msg}</div>;
}

/* icons used only by the chrome (kept here so they live in one place) */
const Ico = {
  sun: (p) => <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><circle cx="12" cy="12" r="4.2" /><path d="M12 1.5v2.5M12 20v2.5M4 12H1.5M22.5 12H20M5.6 5.6 3.9 3.9M20.1 20.1l-1.7-1.7M18.4 5.6l1.7-1.7M3.9 20.1l1.7-1.7" /></svg>,
  moon: (p) => <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" /></svg>,
  back: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M15 19l-7-7 7-7" /></svg>,
  refresh: (p) => <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>,
  telegram: (p) => <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" /></svg>,
  code: (p) => <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M8 18l-6-6 6-6M16 6l6 6-6 6" /></svg>,
  heart: (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" {...p}><path d="M12 21s-7.5-4.7-10-9.3C.4 8.4 1.9 5 5.2 5c2 0 3.4 1.2 4.3 2.4C10.4 6.2 11.8 5 13.8 5 17.1 5 18.6 8.4 17 11.7 14.5 16.3 12 21 12 21z" /></svg>,
  logout: (p) => <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" {...p}><path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" clipRule="evenodd" /><path fillRule="evenodd" d="M6 10a.75.75 0 0 1 .75-.75h9.546l-1.048-1.047a.75.75 0 1 1 1.06-1.06l2.352 2.352a.75.75 0 0 1 0 1.06l-2.352 2.352a.75.75 0 1 1-1.06-1.06l1.048-1.047H6.75A.75.75 0 0 1 6 10Z" clipRule="evenodd" /></svg>,
};

export function AppBar({ dark, setDark, back, children }) {
  const { t } = useI18n();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState(null);

  return (
    <>
      {toast && <Toast msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />}
      <header className="appbar">
        <div className="brand">
          {back && (
            <>
              <a className="back" href={back}><Ico.back /> {t("nav.dashboard")}</a>
              <span className="bar-div" />
            </>
          )}
          <span className="logo"><img src={logo} alt="Infinite Servers" /></span>
          <span className="brand-txt">
            <span className="wordmark">Infinite<strong>Servers</strong></span>
            <span className="brand-sub">FLEET INTELLIGENCE</span>
          </span>
        </div>
        {children && <div className="appbar-page-ctrls">{children}</div>}
        <div className="appbar-icons">
          <button className="icon-btn" title={t("nav.telegramCheck")} onClick={async () => {
            const r = await telegramCheck();
            if (r.ok) {
              if (r.sent > 0 && r.failed === 0) setToast({ msg: `发送成功，共 ${r.sent} 条提醒`, ok: true });
              else if (r.sent > 0 && r.failed > 0) setToast({ msg: `部分失败：成功 ${r.sent} 条，失败 ${r.failed} 条`, ok: false });
              else if (r.failed > 0) setToast({ msg: `发送失败：${r.failed} 条`, ok: false });
              else setToast({ msg: "没有在提醒窗口内的服务器", ok: true });
            } else setToast({ msg: r.error || "Telegram 未配置", ok: false });
          }}>
            <Ico.telegram />
          </button>
          <button className="icon-btn" title={t("nav.refresh")} onClick={() => { triggerRefresh("all"); setToast({ msg: t("toast.refreshSuccess"), ok: true }); }}>
            <Ico.refresh />
          </button>
          <button className="icon-btn" title={t("theme.toggle")} onClick={() => setDark(!dark)}>
            {dark ? <Ico.sun /> : <Ico.moon />}
          </button>
          <LangToggle />
          {isLoggedIn() && <SettingsButton onOpen={() => setSettingsOpen(true)} />}
          <button className="icon-btn" title={t("nav.logout")} onClick={async () => { await logout(); window.location.href = "/"; }}>
            <Ico.logout />
          </button>
        </div>
      </header>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="site-footer">
      <span className="foot-copy">Copyright© {new Date().getFullYear()} <a className="foot-link" href="https://github.com/zhojielun" target="_blank" rel="noopener noreferrer">zhojielun</a>. {t("footer.rights")}</span>
      <span className="foot-love">
        <Ico.code /> with <a className="foot-heart-link" href="https://github.com/zhojielun/infinite-servers" target="_blank" rel="noopener noreferrer" title={t("footer.source")}><Ico.heart className="foot-heart" /></a>
      </span>
    </footer>
  );
}
