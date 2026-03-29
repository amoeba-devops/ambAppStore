import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { parameterApi, seasonalityApi, channelApi } from '@/services/api';

export function useParameters() {
  return useQuery({ queryKey: ['settings', 'parameters'], queryFn: parameterApi.get });
}

export function useUpdateParameters() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: parameterApi.update, onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'parameters'] }) });
}

export function useSeasonality() {
  return useQuery({ queryKey: ['settings', 'seasonality'], queryFn: seasonalityApi.get });
}

export function useUpdateSeasonality() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: seasonalityApi.update, onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'seasonality'] }) });
}

export function useChannels() {
  return useQuery({ queryKey: ['channels', 'list'], queryFn: channelApi.getAll });
}

export function useCreateChannel() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: channelApi.create, onSuccess: () => qc.invalidateQueries({ queryKey: ['channels', 'list'] }) });
}
