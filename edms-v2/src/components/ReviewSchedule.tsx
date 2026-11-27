'use client';
import {useState, type FormEvent} from 'react';
import s from './FileExplorer.module.css';
import w from '../app/workspace.module.css';

const wib = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  hourCycle: 'h23', timeZone: 'Asia/Jakarta',
});
export function reviewDate(value: string | null) {
  return value ? wib.format(new Date(value)) + ' WIB' : '—';
}

function inputWib(time: number) {
  return new Date(time + 7 * 3600_000).toISOString().slice(0, 16);
}

export function ReviewSchedule({dueAt, custom, clockOffset, busy, onSave}: {
  dueAt: string; custom: boolean; clockOffset: number; busy: boolean;
  onSave: (value: string | null) => void;
}) {
  const [value, setValue] = useState(() => inputWib(Date.parse(dueAt)));
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(value);
  }
  return <form className={s.dialogForm} onSubmit={submit}>
    <h3>Jadwal review</h3>
    <p>{custom ? 'Jadwal khusus' : 'Jadwal tahunan'} · {reviewDate(dueAt)}</p>
    <label>Tinjau kembali (WIB)
      <input type="datetime-local" name="dueAtWib" value={value} required
        onChange={event => setValue(event.target.value)}/>
    </label>
    <div className={s.scheduleActions}>
      <button type="button" className={w.secondary} disabled={busy}
        onClick={() => setValue(inputWib(Math.ceil((Date.now() + clockOffset) / 60_000) * 60_000 + 60_000))}>Dalam 2 menit</button>
      <button type="submit" className={w.primary} disabled={busy}>Simpan jadwal</button>
      {custom && <button type="button" className={w.textButton} disabled={busy} onClick={() => onSave(null)}>Kembali ke jadwal tahunan</button>}
    </div>
    <small>Jadwal berlaku untuk satu siklus pada dokumen ini. Setelah review berikutnya, tenggat kembali satu tahun.</small>
  </form>;
}
