import { useDemo } from '@/contexts/DemoContext';
import { getDemoIssues, getDemoProject, MOCK_ISSUES, MOCK_PROJECT } from '@/data/mock-data';

export function useDemoData() {
  const { isDemoMode, demoProfile } = useDemo();
  if (!isDemoMode) return { issues: MOCK_ISSUES, project: MOCK_PROJECT };
  return { issues: getDemoIssues(demoProfile), project: getDemoProject(demoProfile) };
}
