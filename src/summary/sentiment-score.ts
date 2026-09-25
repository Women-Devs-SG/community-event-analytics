// Lexicon (AFINN) sentiment with a prior from the survey question the text answers.
// Runs at build time only, so the lexicon library is not shipped to the browser.
// The canonical question roles describe the intent of the configured survey
// question without coupling the analysis to one source's column values.
import Sentiment from 'sentiment';
import type { SentimentLabel } from '../sentiment';
import type { FeedbackRecord } from '../types';

const analyzer = new Sentiment();

// "nothing to improve" style answers to text_improve are actually praise
const NOTHING_RE =
  /^(nothing|none|nil|nope|no|n\/?a|-|all good|nothing much|nothing really|nothing so far|no comments?|keep it up|great as is)[.!\s]*$/i;
// bare "nothing/none", under text_good this means nothing WAS good
const NONE_RE = /^(nothing|none|nil|nope|no|n\/?a|-)[.!\s]*$/i;

export function scoreFeedback(row: Pick<FeedbackRecord, 'text' | 'question_role'>): {
  score: number;
  label: SentimentLabel;
} {
  const text = row.text.trim();
  const comparative = analyzer.analyze(text).comparative;

  // the question asked carries most of the signal: an answer to "what was good"
  // names praise even when the lexicon misreads a word ("mock interview")
  if (row.question_role === 'positive') {
    if (NONE_RE.test(text)) return { score: comparative, label: 'negative' };
    return { score: comparative, label: comparative < -0.5 ? 'neutral' : 'positive' };
  }
  if (row.question_role === 'improvement' && NOTHING_RE.test(text)) {
    return { score: comparative, label: 'positive' };
  }
  const prior = row.question_role === 'improvement' ? -0.1 : 0;
  const adjusted = comparative + prior;
  const label: SentimentLabel = adjusted > 0.05 ? 'positive' : adjusted < -0.05 ? 'negative' : 'neutral';
  return { score: comparative, label };
}
