import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UserRating {
  averageRating: number;
  totalRatings: number;
  ratings: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

export const useUserRating = (userId: string | undefined) => {
  const [rating, setRating] = useState<UserRating | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    fetchUserRating();
  }, [userId]);

  const fetchUserRating = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from("user_ratings")
        .select("rating")
        .eq("rated_user_id", userId);

      if (error) throw error;

      if (data && data.length > 0) {
        const ratings = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        let totalRating = 0;

        data.forEach((r) => {
          ratings[r.rating as keyof typeof ratings]++;
          totalRating += r.rating;
        });

        setRating({
          averageRating: totalRating / data.length,
          totalRatings: data.length,
          ratings,
        });
      } else {
        setRating({
          averageRating: 0,
          totalRatings: 0,
          ratings: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        });
      }
    } catch (error) {
      console.error("Error fetching user rating:", error);
    } finally {
      setLoading(false);
    }
  };

  return { rating, loading, refresh: fetchUserRating };
};
