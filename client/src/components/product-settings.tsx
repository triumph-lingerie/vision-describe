import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings2, Plus, Trash2 } from "lucide-react";

const settingsSchema = z.object({
  language: z.string().min(1, "Language is required"),
  category: z.string().min(1, "Product category is required"),
  certifications: z.array(z.object({
    value: z.string().optional()
  })).default([{ value: "" }]),
});

type SettingsForm = z.infer<typeof settingsSchema>;

interface ProductSettingsProps {
  onSettingsChange: (settings: SettingsForm) => void;
  defaultSettings?: SettingsForm;
}

export function ProductSettings({ onSettingsChange, defaultSettings }: ProductSettingsProps) {
  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      language: defaultSettings?.language || "uk",
      category: defaultSettings?.category || "",
      certifications: defaultSettings?.certifications || [{ value: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "certifications"
  });

  const onSubmit = (values: SettingsForm) => {
    // Filter out empty certifications and join with comma
    const filteredCertifications = values.certifications
      .filter(cert => cert.value && cert.value.trim() !== "")
      .map(cert => cert.value!)
      .join(", ");
    
    const formattedValues = {
      ...values,
      certifications: filteredCertifications ? [{ value: filteredCertifications }] : []
    };
    
    onSettingsChange(formattedValues);
  };

  const languages = [
    { code: "uk", name: "English (UK)" },
    { code: "de", name: "Deutsch" },
    { code: "fr", name: "Français" },
    { code: "it", name: "Italiano" },
    { code: "es", name: "Español" },
    { code: "pt", name: "Português" },
    { code: "nl", name: "Nederlands" },
    { code: "da", name: "Dansk" },
    { code: "sv", name: "Svenska" },
    { code: "no", name: "Norsk" },
    { code: "fi", name: "Suomi" },
    { code: "pl", name: "Polski" },
    { code: "cs", name: "Čeština" },
    { code: "sk", name: "Slovenčina" },
    { code: "hu", name: "Magyar" },
    { code: "ro", name: "Română" },
    { code: "bg", name: "Български" },
    { code: "hr", name: "Hrvatski" },
    { code: "sl", name: "Slovenščina" },
    { code: "et", name: "Eesti" },
    { code: "lv", name: "Latviešu" },
    { code: "lt", name: "Lietuvių" },
    { code: "el", name: "Ελληνικά" },
    { code: "mt", name: "Malti" },
    { code: "ga", name: "Gaeilge" },
    { code: "fr-be", name: "Français (Belgique)" },
    { code: "nl-be", name: "Nederlands (België)" },
    { code: "de-at", name: "Deutsch (Österreich)" },
    { code: "de-ch", name: "Deutsch (Schweiz)" },
    { code: "fr-ch", name: "Français (Suisse)" },
    { code: "it-ch", name: "Italiano (Svizzera)" },
    { code: "lb", name: "Lëtzebuergesch" },
  ];



  return (
    <Card className="p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Settings2 className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Product Settings</h3>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Language</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {languages.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Category</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., bra, panties, thong..." 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>



          <div className="space-y-2">
            <FormLabel>Certifications</FormLabel>
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-2">
                <FormField
                  control={form.control}
                  name={`certifications.${index}.value`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input
                          placeholder="e.g., OEKO-TEX® STANDARD 100"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ value: "" })}
              className="mt-2"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Certification
            </Button>
          </div>

          <Button type="submit" className="w-full">
            Update Settings
          </Button>
        </form>
      </Form>
    </Card>
  );
}