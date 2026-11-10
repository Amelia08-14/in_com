import { TrackView } from '@/components/landing/Track';

export default async function SuiviCode({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <TrackView code={decodeURIComponent(code).toUpperCase()} />;
}
