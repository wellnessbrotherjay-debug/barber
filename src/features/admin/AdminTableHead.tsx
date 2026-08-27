import React from 'react';

/**
 * The heading row of a table on the admin screens: the column names, in the
 * one style they are all drawn in.
 *
 * WHY THIS EXISTS
 *   Seven tables across the two admin screens each wrote out the same row and
 *   the same cell styling by hand, differing only in the words. That is how a
 *   column ends up a different colour on one screen than another after somebody
 *   corrects a single table and not the other six.
 *
 * Give it the column names in the order they appear.
 */
export default function AdminTableHead({ columns }: { columns: string[] }) {
  return (
    <tr className="text-left text-[#a09cab] border-b border-[#d4d2e3]">
      {columns.map((label) => (
        <th key={label} className="py-2 pr-4">
          {label}
        </th>
      ))}
    </tr>
  );
}
