import { requireVerifiedAuth } from "@/lib/auth";
import { getChildProfile, getDashboardData, getFoodTimeline } from "@/lib/data";
import { normalizeTimezoneOffsetMinutes } from "@/lib/date-utils";
import { buildPediatricReportFileName, buildPediatricReportLines } from "@/lib/pediatric-report";
import { hasPremiumFeatureAccess } from "@/lib/premium-features";
import { createTextPdfDocument } from "@/lib/simple-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getTimezoneOffsetFromRequest(request: Request) {
  const requestUrl = new URL(request.url);
  const rawOffset = requestUrl.searchParams.get("tzOffsetMinutes");
  return normalizeTimezoneOffsetMinutes(rawOffset, 0);
}

export async function GET(request: Request) {
  const user = await requireVerifiedAuth();
  if (!hasPremiumFeatureAccess(user, "pediatric_report_pdf")) {
    return new Response("Rapport pédiatre réservé à l'offre Premium.", {
      status: 402,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "private, no-store, max-age=0"
      }
    });
  }

  const timezoneOffsetMinutes = getTimezoneOffsetFromRequest(request);
  const generatedAt = new Date();

  let childProfile: Awaited<ReturnType<typeof getChildProfile>> = null;
  let categories: Awaited<ReturnType<typeof getDashboardData>> = [];
  let timelineEntries: Awaited<ReturnType<typeof getFoodTimeline>> = [];

  try {
    [childProfile, categories, timelineEntries] = await Promise.all([
      getChildProfile(user.id),
      getDashboardData(user.id),
      getFoodTimeline(user.id)
    ]);
  } catch (error) {
    console.error("[pediatric-report] Failed to load user data.", error);
    return Response.json(
      { ok: false, error: "Impossible de générer le rapport pour le moment." },
      { status: 503 }
    );
  }

  const reportLines = buildPediatricReportLines({
    childProfile,
    categories,
    timelineEntries,
    generatedAt,
    timezoneOffsetMinutes
  });

  const pdf = createTextPdfDocument({
    title: "Grrrignote - Rapport pediatre",
    lines: reportLines
  });

  const fileName = buildPediatricReportFileName(childProfile?.firstName, generatedAt, timezoneOffsetMinutes);

  return new Response(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Length": String(pdf.byteLength)
    }
  });
}
