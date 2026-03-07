import { PublicShareUnavailable } from "@/components/public-share-unavailable";

export const metadata = {
  robots: {
    index: false,
    follow: false
  }
};

export default function LegacySharePage() {
  return <PublicShareUnavailable />;
}
