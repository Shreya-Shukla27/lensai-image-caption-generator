const tones = [
  { value: 'neutral', label: 'Neutral', desc: 'Clear & factual' },
  { value: 'poetic', label: 'Poetic', desc: 'Lyrical & artistic' },
  { value: 'funny', label: 'Funny', desc: 'Witty & humorous' },
  { value: 'professional', label: 'Professional', desc: 'Formal & precise' },
  { value: 'instagram', label: 'Instagram', desc: 'Trendy & engaging' },
];

export default function ToneSelector({ selected, onChange }) {
  return (
    <fieldset>
      <legend className="block text-sm font-body text-muted mb-3">
        Caption tone
      </legend>
      <div className="flex flex-wrap gap-2">
        {tones.map((tone) => (
          <button
            key={tone.value}
            type="button"
            onClick={() => onChange(tone.value)}
            aria-pressed={selected === tone.value}
            title={`${tone.label}: ${tone.desc}`}
            className={`
              px-4 py-2 rounded-xl text-sm font-body transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70
              ${selected === tone.value
                ? 'bg-accent/15 border-accent/50 text-accent-light'
                : 'bg-panel border-border text-muted hover:border-accent/30 hover:text-white'
              }
            `}
          >
            {tone.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
