import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productMasterExcelApi, type ProductMasterImportResult } from '@/services/product-master-excel.service';

function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export function useDownloadTemplate() {
  return useMutation({
    mutationFn: async () => {
      const res = await productMasterExcelApi.downloadTemplate();
      downloadBlob(res.data, 'product-master-template.xlsx');
    },
  });
}

export function useExportProductMaster() {
  return useMutation({
    mutationFn: async () => {
      const res = await productMasterExcelApi.exportData();
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(res.data, `product-master-${date}.xlsx`);
    },
  });
}

export function useImportProductMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<ProductMasterImportResult> => {
      const res = await productMasterExcelApi.importData(file);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sku-masters'] });
      qc.invalidateQueries({ queryKey: ['spu-masters'] });
    },
  });
}
