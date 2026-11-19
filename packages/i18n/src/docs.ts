import type { AppLocale } from "./locale";

/** Upstream project website, linked exclusively from the mandatory AGPL-3.0 §7(b) attribution in Settings › About. */
export const UPSTREAM_SITE = "https://agentes.chat";

/** squadchat's public landing page. */
export const LANDING_SITE = "https://squad-chat-6wd.pages.dev";

/** The public docs site for in-app help pages (`/docs/<slug>`), kept on upstream until squadchat hosts its own docs. */
export const DOCS_SITE = "https://agentes.chat";

/** The docs site's language folders: English at the root, Chinese under `zh/`, Portuguese under `pt/`. */
const FOLDER: Partial<Record<AppLocale, string>> = { en: "", "pt-BR": "pt/", "zh-Hans": "zh/" };

/** A docs page (the index without `slug`) in `locale`, at a section. */
export const docsUrl = (locale: AppLocale, slug?: string, section?: string) =>
  `${DOCS_SITE}/${FOLDER[locale] ?? `${locale}/`}docs${slug ? `/${slug}` : ""}${section ? `#${section}` : ""}`;

/** The desktop app's download page on this server. */
export const DOWNLOAD_URL = "/download";
