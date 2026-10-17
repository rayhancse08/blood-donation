"use client";

import { useState } from "react";
import { DIVISIONS, districtsOf } from "@/lib/bd-locations";
import { Field, inputClass } from "./ui";

export type LocationDefaults = {
  division?: string | null;
  district?: string | null;
  upazila?: string | null;
  thana?: string | null;
};

export function LocationFields({
  defaults,
  required = false,
  filterMode = false,
  showUpazilaThana = true,
}: {
  defaults?: LocationDefaults;
  required?: boolean;
  filterMode?: boolean;
  showUpazilaThana?: boolean;
}) {
  const [division, setDivision] = useState(defaults?.division ?? "");
  const [district, setDistrict] = useState(defaults?.district ?? "");
  const districts = districtsOf(division);

  return (
    <>
      <Field label="Division" required={required}>
        <select
          name="division"
          value={division}
          required={required}
          onChange={(event) => {
            setDivision(event.target.value);
            setDistrict("");
          }}
          className={inputClass}
        >
          <option value="">{filterMode ? "Any division" : "Select division"}</option>
          {DIVISIONS.map((d) => (
            <option key={d.name} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="District" required={required}>
        <select
          name="district"
          value={district}
          required={required}
          disabled={!division}
          onChange={(event) => setDistrict(event.target.value)}
          className={inputClass}
        >
          <option value="">{filterMode ? "Any district" : "Select district"}</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </Field>
      {showUpazilaThana && (
        <>
          <Field label="Upazila">
            <input name="upazila" defaultValue={defaults?.upazila ?? ""} placeholder={filterMode ? "Any upazila" : "e.g. Savar"} className={inputClass} maxLength={100} />
          </Field>
          <Field label="Thana">
            <input name="thana" defaultValue={defaults?.thana ?? ""} placeholder={filterMode ? "Any thana" : "e.g. Dhanmondi"} className={inputClass} maxLength={100} />
          </Field>
        </>
      )}
    </>
  );
}
