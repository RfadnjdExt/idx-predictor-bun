import { json, error } from '@sveltejs/kit';
import { analyzeForeignFlowPdf } from '$lib/server/pdfReader.js';

export async function POST({ request }) {
  let form;
  try {
    form = await request.formData();
  } catch {
    throw error(400, 'Body harus multipart/form-data');
  }

  const file = form.get('pdf');
  if (!file || typeof file === 'string') {
    throw error(400, 'Field "pdf" (file) wajib diisi');
  }
  if (file.type && file.type !== 'application/pdf' && !file.name?.toLowerCase().endsWith('.pdf')) {
    throw error(400, 'File harus berformat PDF');
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let result;
  try {
    result = analyzeForeignFlowPdf(buffer);
  } catch (e) {
    throw error(422, `Gagal membaca PDF: ${e?.message || 'format tidak dikenali'}`);
  }

  if (result.totalRows === 0) {
    throw error(
      422,
      'Tidak ada baris data yang cocok. Fitur ini khusus untuk PDF "Foreign Transaction Midday Data" dari Stockbit.'
    );
  }

  return json(result);
}
