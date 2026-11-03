async function fetchServerApi(host, isBedrock = false, timeoutMs = 2500) {
  const url = isBedrock 
    ? `https://api.mcsrvstat.us/bedrock/3/${encodeURIComponent(host)}`
    : `https://api.mcsrvstat.us/3/${encodeURIComponent(host)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch (err) {
    clearTimeout(timer);
    return null;
  }
}

module.exports = {
  fetchServerApi
};
