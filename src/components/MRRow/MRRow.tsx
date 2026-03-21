import { MergeRequest } from '../../types';
import { StatusBadge } from '../StatusBadge/StatusBadge';
import { AvatarList } from '../AvatarList/AvatarList';
import { Avatar } from '../Avatar/Avatar';
import { formatTimeAgo } from '../../utils/timeFormatter';
import { splitRepositoryPath } from '../../utils/repositoryFormatter';
import { extractJiraTickets, buildJiraTicketUrl } from '../../utils/jira';
import { useConfig } from '../../hooks/useConfig';

interface MRRowProps {
  mr: MergeRequest;
  onMarkAsRead: (id: string) => void;
  onMarkAsUnread: (id: string) => void;
  hasNewComments: boolean;
  isRead: boolean;
  onLabelClick?: (label: string) => void;
}

export function MRRow({ mr, onMarkAsRead, onMarkAsUnread, hasNewComments, isRead, onLabelClick }: MRRowProps) {
  const handleMRClick = () => {
    onMarkAsRead(mr.id);
  };

  const handleMarkAsUnread = () => {
    onMarkAsUnread(mr.id);
  };

  const repoParts = splitRepositoryPath(mr.repository);
  const { config } = useConfig();
  const tickets = extractJiraTickets(mr.sourceBranch, mr.title, (mr as any).description);

  return (
    <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
      {/* Merge Request Column */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <a
              href={mr.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleMRClick}
              className={`hover:underline ${hasNewComments
                ? 'text-blue-700 font-bold'
                : 'text-blue-600 font-medium'
                } hover:text-blue-800`}
            >
              {mr.title}
            </a>
            {hasNewComments && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                New
              </span>
            )}
          </div>
          {/* MR Tags/Labels are shown in the dedicated Labels column for desktop table */}
          <div className="text-sm text-gray-500 flex items-center gap-2 flex-wrap">
            {repoParts ? (
              <span className="flex items-center gap-1">
                <span>{repoParts.namespace}</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">
                  {repoParts.projectName}
                </span>
              </span>
            ) : (
              <span>{mr.repository}</span>
            )}
            <span>•</span>
            <span>#{mr.iid}</span>
            <span>•</span>
            <span>{formatTimeAgo(mr.createdAt)}</span>
          </div>
        </div>
      </td>

      {/* Jira Column */}
      <td className="px-4 py-3">
        {tickets && tickets.length > 0 ? (
          <div className="flex items-center gap-2 flex-wrap">
            {tickets.map((t) => {
              const url = buildJiraTicketUrl(t, config.jiraHost);
              return url ? (
                <a key={t} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {t}
                </a>
              ) : (
                <span key={t} className="text-gray-700">{t}</span>
              );
            })}
          </div>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        )}
      </td>

      {/* Status Column */}
      <td className="px-4 py-3">
        <StatusBadge status={mr.status} updatedAt={mr.statusUpdatedAt} hasNewComments={hasNewComments} />
      </td>

      {/* Author Column */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <div className="relative group">
            <Avatar
              src={mr.author.avatarUrl}
              name={mr.author.name}
              username={mr.author.username}
              size="sm"
            />
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {mr.author.name} (@{mr.author.username})
            </div>
          </div>
        </div>
      </td>

      {/* Reviewer Column */}
      <td className="px-4 py-3">
        <AvatarList people={mr.reviewers} />
      </td>

      {/* Approver Column */}
      <td className="px-4 py-3">
        <AvatarList people={mr.approvers} />
      </td>

      {/* Action Column */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {isRead && (
            <button
              onClick={handleMarkAsUnread}
              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
              title="Mark as Unread"
            >
              ✉️
            </button>
          )}
        </div>
      </td>

      {/* Labels Column */}
      <td className="px-4 py-3">
        {mr.labels && mr.labels.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {mr.labels.map((label) => (
              <span
                key={label}
                className="inline-block bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-0.5 rounded-full border border-yellow-200 cursor-pointer hover:bg-yellow-200"
                title={`Filter by ${label}`}
                onClick={() => onLabelClick && onLabelClick(label)}
              >
                {label}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        )}
      </td>
    </tr>
  );
}

