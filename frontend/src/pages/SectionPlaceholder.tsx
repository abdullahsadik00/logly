import { useLocation } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { EmptyState } from '@/components/composite/EmptyState';
import { titleForSegment } from '@/layouts/nav';

/**
 * Stand-in for nav destinations not yet built, so the sidebar is fully
 * navigable during the incremental build. Each section replaces this in its
 * own cycle.
 */
export default function SectionPlaceholder() {
  const { pathname } = useLocation();
  const segment = pathname.split('/').filter(Boolean).pop() ?? '';
  const title = titleForSegment(segment);

  return (
    <EmptyState
      icon={Construction}
      title={`${title} is on the way`}
      description="This section is part of the incremental build toward the design brief and lands in an upcoming cycle."
    />
  );
}
