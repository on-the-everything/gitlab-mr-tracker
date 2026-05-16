import type { RepositoryGroup } from "../types";

interface RepositoryItem {
  repository: string;
}

function normalizeRepositoryValue(value: string): string {
  return value.trim().toLowerCase();
}

function getProjectName(repository: string): string {
  const normalized = normalizeRepositoryValue(repository);
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

export function repositoryMatchesGroup(
  repository: string,
  group: RepositoryGroup,
): boolean {
  const normalizedRepository = normalizeRepositoryValue(repository);
  const projectName = getProjectName(repository);

  return group.repositories.some((groupRepository) => {
    const normalizedGroupRepository = normalizeRepositoryValue(groupRepository);
    return (
      normalizedGroupRepository.length > 0 &&
      (normalizedRepository === normalizedGroupRepository ||
        projectName === normalizedGroupRepository)
    );
  });
}

export function filterMRsByRepositoryGroups<T extends RepositoryItem>(
  mrs: T[],
  repositoryGroups: RepositoryGroup[],
  selectedRepositoryGroups: string[],
): T[] {
  const selectedNames = new Set(
    selectedRepositoryGroups.map(normalizeRepositoryValue).filter(Boolean),
  );

  if (selectedNames.size === 0) {
    return mrs;
  }

  const selectedGroups = repositoryGroups.filter((group) =>
    selectedNames.has(normalizeRepositoryValue(group.name)),
  );

  if (selectedGroups.length === 0) {
    return [];
  }

  return mrs.filter((mr) =>
    selectedGroups.some((group) => repositoryMatchesGroup(mr.repository, group)),
  );
}
