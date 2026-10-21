type GoogleAddressComponent = {
  long_name?: string;
  short_name?: string;
  types?: string[];
};

export type GoogleGeocodeResult = {
  address_components?: GoogleAddressComponent[];
  formatted_address?: string;
};

function componentValue(components: GoogleAddressComponent[], type: string, short = false) {
  const component = components.find((item) => item.types?.includes(type));
  return (short ? component?.short_name : component?.long_name)?.trim() ?? "";
}

export function formatGoogleAddress(result: GoogleGeocodeResult) {
  const components = result.address_components ?? [];
  const streetNumber = componentValue(components, "street_number");
  const route = componentValue(components, "route");
  const premise = componentValue(components, "premise");
  const locality = componentValue(components, "locality");
  const postalTownComponent = componentValue(components, "postal_town");
  const localArea = componentValue(components, "sublocality_level_1")
    || componentValue(components, "sublocality")
    || componentValue(components, "neighborhood")
    || componentValue(components, "colloquial_area")
    || (postalTownComponent && locality !== postalTownComponent ? locality : "");
  const postalCode = componentValue(components, "postal_code");
  const postalTown = postalTownComponent
    || locality
    || componentValue(components, "administrative_area_level_2");
  const streetOrPremise = route || premise;
  const streetOrPremiseIncludesNumber = Boolean(streetNumber)
    && streetOrPremise.split(/\s+/).some((part) => part.toLowerCase() === streetNumber.toLowerCase());
  const needsLocalArea = Boolean(localArea)
    && Boolean(streetNumber)
    && (!streetOrPremise || streetOrPremise === streetNumber || /^\d+[a-z]?$/i.test(streetOrPremise));
  const streetLine = needsLocalArea
    ? [localArea, streetNumber].filter(Boolean).join(" ")
    : [streetOrPremise, streetNumber && !streetOrPremiseIncludesNumber ? streetNumber : ""].filter(Boolean).join(" ");
  const cityLine = [postalCode, postalTown].filter(Boolean).join(" ");
  return [streetLine, cityLine].filter(Boolean).join(", ") || result.formatted_address || "";
}
