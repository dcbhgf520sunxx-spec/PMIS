type RefreshFollowUpDetailOptions<TFollowUp, THistory> = {
  loadFollowUps: () => Promise<TFollowUp[]>;
  loadHistory: () => Promise<THistory[]>;
  apply: (followUps: TFollowUp[], history: THistory[]) => void;
};

export async function refreshFollowUpDetail<TFollowUp, THistory>({
  loadFollowUps,
  loadHistory,
  apply,
}: RefreshFollowUpDetailOptions<TFollowUp, THistory>) {
  const [followUps, history] = await Promise.all([loadFollowUps(), loadHistory()]);
  apply(followUps, history);
}
