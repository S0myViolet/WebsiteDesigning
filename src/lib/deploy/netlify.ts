// Demo-link publishing via the Netlify API (free tier permits commercial
// use). The self-contained preview HTML is zipped as index.html and pushed as
// a static site on an unguessable *.netlify.app subdomain — draft-labeled and
// noindexed, intended to be shared privately with the business owner.

import JSZip from "jszip";
import { fetch as undiciFetch, ProxyAgent } from "undici";

const API = "https://api.netlify.com/api/v1";

/** Route through HTTPS_PROXY when set (sandboxes/corporate networks). */
function proxiedFetch(
  url: string,
  init: Parameters<typeof undiciFetch>[1] = {}
): ReturnType<typeof undiciFetch> {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (proxy) {
    return undiciFetch(url, { ...init, dispatcher: new ProxyAgent(proxy) });
  }
  return undiciFetch(url, init);
}

interface NetlifySite {
  id: string;
  ssl_url?: string;
  url?: string;
}

interface NetlifyDeploy {
  id: string;
  state?: string;
  ssl_url?: string;
  url?: string;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "draft"
  );
}

async function readError(res: { status: number; text(): Promise<string> }): Promise<string> {
  const body = await res.text().catch(() => "");
  return `Netlify API error (HTTP ${res.status})${body ? `: ${body.slice(0, 200)}` : ""}`;
}

/**
 * Publish (or re-publish) a demo site. When siteId is provided the same URL
 * is updated in place; otherwise a new site with an unguessable name is
 * created. Returns the https URL and the site id to store for re-publishing.
 */
export async function publishDemo(args: {
  html: string;
  businessName: string;
  token: string;
  siteId?: string | null;
}): Promise<{ url: string; siteId: string }> {
  const zip = new JSZip();
  zip.file("index.html", args.html);
  const body = await zip.generateAsync({ type: "nodebuffer" });

  const headers = {
    Authorization: `Bearer ${args.token}`,
    "Content-Type": "application/zip",
  };

  let site: NetlifySite;
  let deploy: NetlifyDeploy | null = null;

  if (args.siteId) {
    // Re-publish to the existing site (same URL).
    const res = await proxiedFetch(`${API}/sites/${args.siteId}/deploys`, {
      method: "POST",
      headers,
      body,
    });
    if (res.status === 404) {
      // Site was deleted on Netlify — fall through to creating a fresh one.
      site = await createSite();
    } else {
      if (!res.ok) throw new Error(await readError(res));
      deploy = (await res.json()) as NetlifyDeploy;
      site = { id: args.siteId, ssl_url: deploy.ssl_url, url: deploy.url };
    }
  } else {
    site = await createSite();
  }

  async function createSite(): Promise<NetlifySite> {
    // Random suffix makes the URL unguessable (privacy for the prospect).
    const name = `${slugify(args.businessName)}-${Math.random().toString(36).slice(2, 8)}`;
    const res = await proxiedFetch(`${API}/sites?name=${encodeURIComponent(name)}`, {
      method: "POST",
      headers,
      body,
    });
    if (!res.ok) throw new Error(await readError(res));
    return (await res.json()) as NetlifySite;
  }

  const url = site.ssl_url || site.url;
  if (!url) throw new Error("Netlify did not return a site URL.");
  return { url, siteId: site.id };
}
