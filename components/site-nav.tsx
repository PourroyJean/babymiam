import Image from "next/image";
import Link from "next/link";
import { ProfileMenu } from "@/components/profile-menu";
import type { ChildProfile, ProgressSummary } from "@/lib/types";

type SiteNavProps = {
  activePage: "suivi" | "blog" | "account";
  childProfile: ChildProfile | null;
  progressSummary?: ProgressSummary | null;
  contextTitle?: string | null;
};

const NAV_LOGO_RENDER_SIZE = 190;

function getLinkClassName(isActive: boolean) {
  return isActive ? "site-nav-link is-active" : "site-nav-link";
}

export function SiteNav({
  activePage,
  childProfile,
  progressSummary = null,
  contextTitle = null
}: SiteNavProps) {
  return (
    <header className="site-nav">
      <div className="site-nav-main">
        <div className="site-brand">
          <Link href="/" className="site-logo-link" aria-label="Aller à l'accueil Grrrignote">
            <span className="site-logo" aria-hidden="true">
              <Image
                src="/images/brand/grrrignote-logo.webp"
                alt=""
                width={NAV_LOGO_RENDER_SIZE}
                height={NAV_LOGO_RENDER_SIZE}
                className="site-logo-image"
              />
            </span>
          </Link>
          <span className="site-brand-text">Grrrignote</span>
        </div>

        <nav className="site-nav-links" aria-label="Navigation principale">
          <Link
            href="/"
            className={getLinkClassName(activePage === "suivi")}
            aria-current={activePage === "suivi" ? "page" : undefined}
          >
            Suivi
          </Link>
          <Link
            href="/blog"
            className={getLinkClassName(activePage === "blog")}
            aria-current={activePage === "blog" ? "page" : undefined}
          >
            Blog
          </Link>
        </nav>

        {contextTitle ? <h1 className="site-nav-context">{contextTitle}</h1> : null}
      </div>

      <div className="site-account-actions">
        <ProfileMenu initialProfile={childProfile} progressSummary={progressSummary} />
      </div>
    </header>
  );
}
