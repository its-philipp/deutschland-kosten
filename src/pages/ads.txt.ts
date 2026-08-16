import type { APIRoute } from 'astro';
import { adsTxt } from '../lib/ads';

/**
 * `/ads.txt`, generated from the one `ADSENSE_CLIENT` constant. While ads are
 * off the file is served empty rather than omitted: a 200 with no publisher
 * line states "we have no ad relationships", which is true, and it means the
 * route already exists when the constant is finally filled in.
 */
export const GET: APIRoute = () =>
  new Response(adsTxt(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
