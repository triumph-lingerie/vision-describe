import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings2, Plus, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";

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
  const [selectedLanguage, setSelectedLanguage] = useState(defaultSettings?.language || "en");
  const [isLanguageChanging, setIsLanguageChanging] = useState(false);
  const [flagAnimation, setFlagAnimation] = useState("");

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      language: defaultSettings?.language || "en",
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
    { code: "cs", name: "Čeština", flag: "🇨🇿" },
    { code: "da", name: "Dansk", flag: "🇩🇰" },
    { code: "nl", name: "Nederlands", flag: "🇳🇱" },
    { code: "en", name: "English", flag: "🇬🇧" },
    { code: "fr", name: "Français", flag: "🇫🇷" },
    { code: "de", name: "Deutsch", flag: "🇩🇪" },
    { code: "hu", name: "Magyar", flag: "🇭🇺" },
    { code: "it", name: "Italiano", flag: "🇮🇹" },
    { code: "pl", name: "Polski", flag: "🇵🇱" },
    { code: "pt", name: "Português", flag: "🇵🇹" },
    { code: "es", name: "Español", flag: "🇪🇸" },
    { code: "sv", name: "Svenska", flag: "🇸🇪" },
  ];

  const handleLanguageChange = (newLanguage: string) => {
    setIsLanguageChanging(true);
    setFlagAnimation("flag-celebration");
    
    setTimeout(() => {
      setSelectedLanguage(newLanguage);
      form.setValue("language", newLanguage);
      setIsLanguageChanging(false);
      setFlagAnimation("flag-bounce");
      
      // Clear animation after completion
      setTimeout(() => setFlagAnimation(""), 400);
    }, 150);
  };

  const getSelectedLanguage = () => {
    return languages.find(lang => lang.code === selectedLanguage);
  };



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
                  <FormLabel className="flex items-center gap-2">
                    Language
                    {getSelectedLanguage() && (
                      <span 
                        className={`text-xl transition-all duration-200 ${flagAnimation} ${
                          isLanguageChanging ? 'scale-125 rotate-12' : 'scale-100 rotate-0'
                        }`}
                      >
                        {getSelectedLanguage()?.flag}
                      </span>
                    )}
                  </FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      handleLanguageChange(value);
                      field.onChange(value);
                    }} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="transition-all duration-200 hover:border-primary/50">
                        <SelectValue placeholder="Select language">
                          {getSelectedLanguage() && (
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{getSelectedLanguage()?.flag}</span>
                              <span>{getSelectedLanguage()?.name}</span>
                            </div>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {languages.map((lang) => (
                        <SelectItem 
                          key={lang.code} 
                          value={lang.code}
                          className="transition-all duration-200 hover:bg-primary/10"
                        >
                          <div className="flex items-center gap-2">
                            <span 
                              className="text-lg flag-hover transition-transform duration-200 hover:scale-110"
                            >
                              {lang.flag}
                            </span>
                            <span>{lang.name}</span>
                          </div>
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
                      placeholder="e.g., bra, panties, thong, bodysuit, corset..." 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Be specific: Use exact product type names for best results
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>



          <div className="space-y-2">
            <FormLabel>Certifications</FormLabel>
            <FormDescription className="text-xs text-muted-foreground">
              Add quality certifications like OEKO-TEX®, STANDARD 100, etc. (Optional)
            </FormDescription>
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-2">
                <FormField
                  control={form.control}
                  name={`certifications.${index}.value`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input
                          placeholder="e.g., OEKO-TEX® STANDARD 100, 22.0.22419 Hohenstein HTTI"
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