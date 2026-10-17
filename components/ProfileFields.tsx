import type { User } from "@/generated/prisma/client";
import { GENDERS } from "@/lib/constants";
import { toDateInputValue } from "@/lib/format";
import { GeoInputs } from "./GeoInputs";
import { LocationFields } from "./LocationFields";
import { Avatar, BloodGroupSelect, Field, inputClass, SelectOptions } from "./ui";

export function ProfileFields({ user, onboarding = false }: { user: User; onboarding?: boolean }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar name={user.name} src={user.photoUrl} size={64} />
        <Field label="Profile photo" hint="JPG, PNG or WEBP, max 5 MB">
          <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" className="text-sm" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required>
          <input name="name" defaultValue={user.name ?? ""} required maxLength={100} className={inputClass} />
        </Field>
        <Field label="Date of birth" required>
          <input name="dateOfBirth" type="date" defaultValue={toDateInputValue(user.dateOfBirth)} required className={inputClass} />
        </Field>
        <Field label="Gender" required>
          <select name="gender" defaultValue={user.gender ?? ""} required className={inputClass}>
            <SelectOptions options={GENDERS} placeholder="Select gender" />
          </select>
        </Field>
        <Field label="Blood group" required>
          <BloodGroupSelect defaultValue={user.bloodGroup} required />
        </Field>
      </div>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-gray-900">Address</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <LocationFields
            required
            defaults={{ division: user.division, district: user.district, upazila: user.upazila, thana: user.thana }}
          />
        </div>
        <Field label="Address line" hint="House, road or area. Never shown publicly.">
          <input name="addressLine" defaultValue={user.addressLine ?? ""} maxLength={300} className={inputClass} />
        </Field>
        <Field label="Map location" hint="Used to show you on the donor map and to find help near you. Stored at area level unless you choose exact location in privacy settings.">
          <GeoInputs defaultLat={user.latitude} defaultLng={user.longitude} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-gray-900 sm:col-span-2">Contact</legend>
        <Field label="Contact phone" required hint="Shared only after you accept a request">
          <input name="contactPhone" type="tel" defaultValue={user.contactPhone ?? user.phone ?? ""} required className={inputClass} />
        </Field>
        <div />
        <Field label="Emergency contact name">
          <input name="emergencyContactName" defaultValue={user.emergencyContactName ?? ""} maxLength={100} className={inputClass} />
        </Field>
        <Field label="Emergency contact phone">
          <input name="emergencyContactPhone" type="tel" defaultValue={user.emergencyContactPhone ?? ""} className={inputClass} />
        </Field>
      </fieldset>

      {onboarding && (
        <label className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <input type="checkbox" name="becomeDonor" className="mt-1" />
          <span>
            <span className="block font-semibold text-red-800">I also want to become a blood donor</span>
            <span className="text-sm text-red-700">
              You can switch between receiver and donor anytime. Donors must be at least 18 years old.
            </span>
          </span>
        </label>
      )}
    </div>
  );
}
