import { createReport, recordReport } from './reports/index.js';
import { renderMessage } from './messages/index.js';
import { sendSms, sleep } from './sms/index.js';

const timestamp = () => {
  const now = new Date();
  return { date: now.toISOString().slice(0, 10), time: now.toTimeString().slice(0, 8) };
};

export async function runCampaign({ recipients, template, config, dryRun = false, onProgress = () => {}, controls = {} }) {
  const context = config.saveReports ? await createReport(controls.reports, { dryRun, total: recipients.length }) : null;
  let success = 0;
  let failed = 0;
  const startedAt = Date.now();

  for (let index = 0; index < recipients.length; index += 1) {
    while (controls.paused && !controls.cancelled) await sleep(150);
    if (controls.cancelled) break;

    const contact = recipients[index];
    const message = renderMessage(template, contact, { index: index + 1, total: recipients.length });
    let status = 'success';
    let error = '';
    try {
      if (!dryRun) await sendSms(contact.number, message, { timeoutMs: config.smsTimeoutMs });
      success += 1;
    } catch (cause) {
      status = 'failed';
      error = cause.message;
      failed += 1;
    }

    const result = { number: contact.number, name: contact.name, status, ...timestamp(), message, error, index: index + 1 };
    if (context) await recordReport(context, result);
    onProgress({ processed: index + 1, total: recipients.length, success, failed, last: contact.number, status, startedAt, paused: false });
    if (index < recipients.length - 1 && !controls.cancelled) await sleep(config.delayMs);
  }

  return { success, failed, cancelled: Boolean(controls.cancelled), reportDir: context?.dir };
}
