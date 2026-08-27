const PLACES_BASE="https://places.googleapis.com/v1";

export async function autocompletePlaces(env,input){
  requireKey(env);
  const query=String(input||"").trim();
  if(query.length<3)return [];
  const response=await fetch(`${PLACES_BASE}/places:autocomplete`,{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "X-Goog-Api-Key":env.GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask":"suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text"
    },
    body:JSON.stringify({input:query,languageCode:"th",regionCode:"TH",includeQueryPredictions:false})
  });
  if(!response.ok)throw new Error(`Google Places autocomplete failed: ${response.status}`);
  const data=await response.json();
  return (data.suggestions||[]).map(item=>item.placePrediction).filter(Boolean).slice(0,6).map(p=>({
    placeId:p.placeId,
    text:p.text?.text||"",
    mainText:p.structuredFormat?.mainText?.text||p.text?.text||"",
    secondaryText:p.structuredFormat?.secondaryText?.text||""
  }));
}

export async function resolvePlace(env,placeId){
  requireKey(env);
  const id=String(placeId||"").trim();
  if(!id)throw new Error("Missing place id");
  const response=await fetch(`${PLACES_BASE}/places/${encodeURIComponent(id)}?languageCode=th`,{
    headers:{
      "X-Goog-Api-Key":env.GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask":"id,displayName,formattedAddress,location"
    }
  });
  if(!response.ok)throw new Error(`Google Place details failed: ${response.status}`);
  const data=await response.json();
  const lat=Number(data.location?.latitude),lng=Number(data.location?.longitude);
  if(!Number.isFinite(lat)||!Number.isFinite(lng))throw new Error("Place location is unavailable");
  const timezone=await lookupTimezone(env,lat,lng);
  return {
    placeId:data.id||id,
    name:data.formattedAddress||data.displayName?.text||"",
    lat,lng,
    timezone:timezone||"Asia/Bangkok"
  };
}

async function lookupTimezone(env,lat,lng){
  const timestamp=Math.floor(Date.now()/1000);
  const url=`https://maps.googleapis.com/maps/api/timezone/json?location=${encodeURIComponent(`${lat},${lng}`)}&timestamp=${timestamp}&key=${encodeURIComponent(env.GOOGLE_MAPS_API_KEY)}`;
  const response=await fetch(url);
  if(!response.ok)return null;
  const data=await response.json();
  return data.status==="OK"&&data.timeZoneId?data.timeZoneId:null;
}

function requireKey(env){if(!env.GOOGLE_MAPS_API_KEY)throw new Error("Google Maps API is not configured")}
