import Image from "next/image";
import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { ProfileMenu } from "@/components/profile-menu";
import type { ChildProfile, ProgressSummary } from "@/lib/types";

type SiteNavProps = {
  activePage: "suivi" | "blog";
  childProfile: ChildProfile | null;
  progressSummary?: ProgressSummary | null;
};

function getLinkClassName(isActive: boolean) {
  return isActive ? "site-nav-link is-active" : "site-nav-link";
}

export function SiteNav({ activePage, childProfile, progressSummary = null }: SiteNavProps) {
  return (
    <header className="site-nav">
      <div className="site-nav-main">
        <Link href="/" className="site-brand" aria-label="Aller à l'accueil Babymiam">
          <span className="site-logo" aria-hidden="true">
            🐯
          </span>
          <span className="site-brand-text">Babymiam</span>
        </Link>

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
      </div>

      <div className="site-account-actions">
        <ProfileMenu initialProfile={childProfile} progressSummary={progressSummary} />
        <form action={logoutAction}>
          <button
            type="submit"
            className="logout-btn logout-icon-btn"
            aria-label="Déconnexion"
            title="Déconnexion"
          >
            <Image
              src="/logout-babymiam.png?v=2"
              alt=""
              aria-hidden="true"
              width={40}
              height={40}
              unoptimized
              className="logout-icon"
            />
          </button>
        </form>
      </div>
    </header>
  );
}
