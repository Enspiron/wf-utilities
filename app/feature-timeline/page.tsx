import type { Metadata } from 'next';
import FeatureTimelineClient from './feature-timeline-client';

export const metadata: Metadata = {
  title: 'Feature Timeline',
  description: 'Unified timeline of feature banners, announcements, and guide dialogs.',
};

export default function FeatureTimelinePage() {
  return <FeatureTimelineClient />;
}
