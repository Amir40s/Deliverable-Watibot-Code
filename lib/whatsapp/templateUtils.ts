export function enrichComponentsWithExamples(
  components: any[],
  sampleValues?: Record<string, string> | string[]
): any[] {
  if (!Array.isArray(components)) return [];

  const getSampleVal = (index: number): string => {
    const key = (index + 1).toString();
    if (sampleValues) {
      if (Array.isArray(sampleValues)) {
        return sampleValues[index] || `Sample ${index + 1}`;
      }
      if (typeof sampleValues === 'object') {
        const valObj = sampleValues as Record<string, string>;
        return valObj[key] || valObj[index.toString()] || `Sample ${index + 1}`;
      }
    }
    return `Sample ${index + 1}`;
  };

  return components.map((comp: any) => {
    if (!comp || typeof comp !== 'object') return comp;
    const updatedComp = { ...comp };

    // 1. BODY Component
    if (updatedComp.type === 'BODY' && typeof updatedComp.text === 'string') {
      const matches = updatedComp.text.match(/\{\{(\d+)\}\}/g);
      if (matches && matches.length > 0 && (!updatedComp.example || !updatedComp.example.body_text)) {
        const variableNumbers = matches.map((m: string) => parseInt(m.replace(/[^\d]/g, ''), 10) || 1);
        const maxIndex = Math.max(...variableNumbers, matches.length);
        const samples = Array.from({ length: maxIndex }, (_, i) => getSampleVal(i));
        updatedComp.example = {
          ...updatedComp.example,
          body_text: [samples]
        };
      }
    }

    // 2. HEADER Component (format: TEXT)
    if (updatedComp.type === 'HEADER' && updatedComp.format === 'TEXT' && typeof updatedComp.text === 'string') {
      const matches = updatedComp.text.match(/\{\{(\d+)\}\}/g);
      if (matches && matches.length > 0 && (!updatedComp.example || !updatedComp.example.header_text)) {
        const variableNumbers = matches.map((m: string) => parseInt(m.replace(/[^\d]/g, ''), 10) || 1);
        const maxIndex = Math.max(...variableNumbers, matches.length);
        const samples = Array.from({ length: maxIndex }, (_, i) => getSampleVal(i));
        updatedComp.example = {
          ...updatedComp.example,
          header_text: samples
        };
      }
    }

    // 3. BUTTONS Component (URL buttons with variables)
    if (updatedComp.type === 'BUTTONS' && Array.isArray(updatedComp.buttons)) {
      updatedComp.buttons = updatedComp.buttons.map((btn: any) => {
        if (!btn || typeof btn !== 'object') return btn;
        const updatedBtn = { ...btn };
        if (updatedBtn.type === 'URL' && typeof updatedBtn.url === 'string') {
          const matches = updatedBtn.url.match(/\{\{(\d+)\}\}/g);
          if (matches && matches.length > 0 && !updatedBtn.example) {
            const variableNumbers = matches.map((m: string) => parseInt(m.replace(/[^\d]/g, ''), 10) || 1);
            const maxIndex = Math.max(...variableNumbers, matches.length);
            updatedBtn.example = Array.from({ length: maxIndex }, (_, i) => getSampleVal(i));
          }
        }
        return updatedBtn;
      });
    }

    // 4. CAROUSEL Component
    if (updatedComp.type === 'CAROUSEL' && Array.isArray(updatedComp.cards)) {
      updatedComp.cards = updatedComp.cards.map((card: any) => {
        if (card && Array.isArray(card.components)) {
          return {
            ...card,
            components: enrichComponentsWithExamples(card.components, sampleValues)
          };
        }
        return card;
      });
    }

    return updatedComp;
  });
}
