import { useMutation } from '@tanstack/react-query';
import { gtinService } from '@/services/gtin.service';

export function useGtinResolve() {
  return useMutation({ mutationFn: gtinService.resolve });
}
