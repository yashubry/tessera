import { useEffect, useState, useCallback } from "react";

export default function useMe() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem("access_token");
    if (!token) {
      setMe(null);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("http://localhost:5000/user/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const j = await res.json(); // { username, email }
      setMe(j);
    } catch (e) {
      setError(e);
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isAdmin =
    !!me?.email && me.email.toLowerCase() === "yashu.bry04@gmail.com";

  return { me, isAdmin, loading, error, reload: load };
}
