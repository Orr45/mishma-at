-- Fix: allow any platoon member to delete checklists (not just creator)

DROP POLICY IF EXISTS "Users can delete own checklists" ON checklists;
DROP POLICY IF EXISTS "Users can remove completions" ON checklist_completions;

CREATE POLICY "Users can delete checklists in their platoon"
  ON checklists FOR DELETE
  USING (platoon_id = (SELECT platoon_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete completions in their platoon"
  ON checklist_completions FOR DELETE
  USING (
    checklist_id IN (
      SELECT id FROM checklists
      WHERE platoon_id = (SELECT platoon_id FROM profiles WHERE id = auth.uid())
    )
  );
