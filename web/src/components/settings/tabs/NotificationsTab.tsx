import { Input } from '@/components/ui/input';
import { useFeatureSettings, useDebouncedFeatureUpdate } from '@/hooks/useFeatureSettings';
import { DEFAULT_FEATURE_SETTINGS } from '@veritas-kanban/shared';
import { SettingRow, ToggleRow, SectionHeader, SaveIndicator } from '../shared';

export function NotificationsTab() {
  const { settings } = useFeatureSettings();
  const { debouncedUpdate, isPending } = useDebouncedFeatureUpdate();

  const update = (key: string, value: any) => {
    debouncedUpdate({ notifications: { [key]: value } });
  };

  const resetNotifications = () => {
    debouncedUpdate({ notifications: DEFAULT_FEATURE_SETTINGS.notifications });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader title="Notifications" onReset={resetNotifications} />
        <SaveIndicator isPending={isPending} />
      </div>
      <div className="divide-y">
        <ToggleRow
          label="Enable Notifications"
          description="Master toggle for all notification sends"
          checked={settings.notifications.enabled}
          onCheckedChange={(v) => update('enabled', v)}
        />
        {settings.notifications.enabled && (
          <>
            <ToggleRow
              label="Task Complete"
              description="Notify when a task moves to Done"
              checked={settings.notifications.onTaskComplete}
              onCheckedChange={(v) => update('onTaskComplete', v)}
            />
            <ToggleRow
              label="Agent Failure"
              description="Notify when an agent run fails"
              checked={settings.notifications.onAgentFailure}
              onCheckedChange={(v) => update('onAgentFailure', v)}
            />
            <ToggleRow
              label="Blocked"
              description="Notify when a task is blocked"
              checked={settings.notifications.onReviewNeeded}
              onCheckedChange={(v) => update('onReviewNeeded', v)}
            />
            <SettingRow label="Channel" description="Teams channel ID for notifications">
              <Input
                value={settings.notifications.channel}
                onChange={(e) => update('channel', e.target.value)}
                placeholder="19:abc...@thread.tacv2"
                className="w-48 h-8 text-xs"
              />
            </SettingRow>
          </>
        )}
      </div>
    </div>
  );
}
