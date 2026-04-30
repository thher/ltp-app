export type Language = 'no' | 'en';

export function tx(language: Language, norwegian: string, english: string) {
  return language === 'en' ? english : norwegian;
}

export function translateRuntimeText(text: string, language: Language): string {
  if (language !== 'en') {
    return text;
  }

  const exact: Record<string, string> = {
    'Tillatt aksellast og egenvekt aksel mÃ¥ ha samme antall verdier.':
      'Allowed axle load and axle own weight must have the same number of values.',
    'LTP trenger minst to lastgrupper for Ã¥ kunne beregnes.':
      'LTP needs at least two load groups before it can be calculated.',
    'Akselavstander mangler.': 'Axle distances are missing.',
    'Egenvekt aksel er hÃ¸yere enn egenvekt med fÃ¸rer. Kontroller tallene fra vognkortet.':
      'Axle own weight is higher than gross own weight with driver. Check the vehicle card values.',
    'Denne kombinasjonen av lastgrupper og akselavstander kan ikke tolkes automatisk ennÃ¥.':
      'This combination of load groups and axle distances cannot be interpreted automatically yet.',
    'Nyttelast foran mÃ¥ vÃ¦re stÃ¸rre enn 0.': 'Front payload must be greater than 0.',
    'Samlet nyttelast mÃ¥ vÃ¦re stÃ¸rre enn 0.': 'Total payload must be greater than 0.',
    'LTP er beregnet automatisk fra vognkortverdiene og rundet opp til nÃ¦rmeste hele cm.':
      'LTP is calculated automatically from the vehicle-card values and rounded up to the nearest whole cm.',
    'LTP for semi trailer trenger tillatt vekt og egenvekt for trekkvogn og trailer.':
      'Semi trailer LTP needs allowed weight and own weight for both tractor and trailer.',
    'Legg inn avstanden fra kingpin / svingskive til midt pÃ¥ trailerboggien for Ã¥ fÃ¥ LTP.':
      'Enter the distance from kingpin / fifth wheel to the center of the trailer bogie to get LTP.',
    'Avstanden fra kingpin til boggisenter mÃ¥ vÃ¦re stÃ¸rre enn 0 mm.':
      'The distance from kingpin to bogie center must be greater than 0 mm.',
    'Nyttelast foran pÃ¥ trekkvognen mÃ¥ vÃ¦re stÃ¸rre enn 0.':
      'Front payload on the tractor must be greater than 0.',
    'Samlet nyttelast for vogntoget mÃ¥ vÃ¦re stÃ¸rre enn 0.':
      'Total payload for the combination must be greater than 0.',
    'LTP for semi trailer er beregnet og rundet opp til nÃ¦rmeste hele cm.':
      'Semi trailer LTP is calculated and rounded up to the nearest whole cm.',
    'sum av vognkortvekter': 'sum of vehicle-card weights',
    'oppgitt vogntogvekt': 'provided combination weight',
    'Buss med 2 aksler bruker egen rad i totalvekttabellen.':
      'A 2-axle bus uses its own row in the total weight table.',
    '3-akslet buss behandles som motorvogn med 3 aksler i totalvekttabellen.':
      'A 3-axle bus is treated as a 3-axle motor vehicle in the total weight table.',
    'Ekstra teknologi-vekt for 3-akslet buss er bare lagt inn for kolonnen Bk10 / 50.':
      'Extra technology weight for a 3-axle bus is only included for the Bk10 / 50 column.',
    'Ekstra teknologi-vekt for buss kan bare brukes i kolonnen Bk10 / 50.':
      'Extra technology weight for bus can only be used in the Bk10 / 50 column.',
    'Ekstra teknologi-vekt for leddbuss kan bare brukes i kolonnen Bk10 / 50.':
      'Extra technology weight for articulated bus can only be used in the Bk10 / 50 column.',
    'Ekstra teknologi-vekt for 2-akslet motorvogn gjelder bare nullutslipp i Bk10 / 50.':
      'Extra technology weight for a 2-axle motor vehicle applies only to zero emission in Bk10 / 50.',
    'Fotnote 6 kan ikke brukes fordi kravene i fotnote 2 ikke er oppfylt.':
      'Footnote 6 cannot be used because the footnote 2 requirements are not met.',
    'Fotnote 1 brukt: fordi kravene i fotnote 2 og 3 ikke er oppfylt, brukes vekt som for 3-akslet motorvogn.':
      'Footnote 1 used: because the footnote 2 and 3 requirements are not met, the 3-axle motor vehicle weight is used.',
    'Fotnote 2 og 3 er oppfylt, sÃ¥ 4-akslet rad brukes direkte.':
      'Footnotes 2 and 3 are met, so the 4-axle row is used directly.',
    'Tillatt aksellast ble hentet fra punkt 8 hvis API-et hadde verdien.':
      'Allowed axle load was fetched from point 8 when the API had the value.',
    'Fant ikke tillatt aksellast automatisk. Sjekk punkt 8 i vognkortet.':
      'Could not find allowed axle load automatically. Check point 8 on the vehicle card.',
    'Akselavstander ble hentet fra punkt 9 hvis API-et hadde verdien.':
      'Axle distances were fetched from point 9 when the API had the value.',
    'Fant ikke akselavstander automatisk. Sjekk punkt 9 (M) i vognkortet.':
      'Could not find axle distances automatically. Check point 9 (M) on the vehicle card.',
    'Fant ikke egenvekt med forer automatisk. Sjekk punkt 8 i vognkortet.':
      'Could not find gross own weight with driver automatically. Check point 8 on the vehicle card.',
    'Mulig to styrende aksler/friksjonsstyring funnet i merknader.':
      'Possible two steering axles / friction steering found in notes.',
    'Skriv inn registreringsnummer forst.': 'Enter registration number first.',
    'Vegvesen API-nokkel mangler, sa skiltoppslag er ikke aktivert enna.':
      'Vegvesen API key is missing, so plate lookup is not active yet.',
    'Kunne ikke kontakte Vegvesen akkurat na. Prov igjen om litt.':
      'Could not contact Vegvesen right now. Try again shortly.',
    'Fant ikke kjoretoydata for dette registreringsnummeret.':
      'No vehicle data found for this registration number.',
    'Vegvesen svarte, men svaret var ikke JSON som appen kunne lese.':
      'Vegvesen responded, but the response was not JSON the app could read.',
  };

  if (exact[text]) {
    return exact[text];
  }

  return text
    .replaceAll('Mindre enn', 'Less than')
    .replaceAll('til og med', 'to')
    .replaceAll('og stÃ¸rre', 'and above')
    .replaceAll('Motorvogn med', 'Motor vehicle with')
    .replaceAll('Buss med', 'Bus with')
    .replaceAll('Leddbuss', 'Articulated bus')
    .replaceAll('semitrailer med', 'semitrailer with')
    .replaceAll('eller flere', 'or more')
    .replaceAll('aksler', 'axles')
    .replaceAll('aksel', 'axle')
    .replaceAll('avstand under', 'distance under')
    .replaceAll('avstand', 'distance')
    .replaceAll('stÃ¸rre', 'above')
    .replaceAll('Tabell', 'Table')
    .replaceAll('Fotnote', 'Footnote')
    .replaceAll('brukt', 'used')
    .replaceAll('tonn ekstra for alternativt drivstoff', 'tons extra for alternative fuel')
    .replaceAll('tonn ekstra for nullutslipp', 'tons extra for zero emission')
    .replaceAll('tonn ekstra for nullutslippskjÃ¸retÃ¸y', 'tons extra for zero-emission vehicle')
    .replaceAll('kjÃ¸retÃ¸y', 'vehicle')
    .replaceAll('motorvogn', 'motor vehicle');
}
