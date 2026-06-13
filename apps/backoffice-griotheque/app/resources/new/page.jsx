"use client";
import SimpleForm from "../../components/SimpleForm";
import { RESOURCE_FIELDS } from "../fields";

export default function ResourceNewPage() {
  return <SimpleForm entity="resources" entityLabel="Ressource" fields={RESOURCE_FIELDS} initial={null} />;
}
