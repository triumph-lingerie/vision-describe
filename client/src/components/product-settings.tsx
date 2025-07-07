import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings2 } from "lucide-react";

const settingsSchema = z.object({
  language: z.string().min(1, "Language is required"),
  category: z.string().min(1, "Product category is required"),
  autoDetectCategory: z.boolean().default(false),
  certifications: z.string().optional(),
  articleNumber: z.string().optional(),
  ean: z.string().optional(),
  composition: z.string().optional(),
});

type SettingsForm = z.infer<typeof settingsSchema>;

interface ProductSettingsProps {
  onSettingsChange: (settings: SettingsForm) => void;
  defaultSettings?: SettingsForm;
}

export function ProductSettings({ onSettingsChange, defaultSettings }: ProductSettingsProps) {
  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: defaultSettings || {
      language: "uk",
      category: "",
      autoDetectCategory: false,
      certifications: "",
      articleNumber: "",
      ean: "",
      composition: "",
    },
  });

  const onSubmit = (values: SettingsForm) => {
    onSettingsChange(values);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Settings2 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-foreground">Settings</h3>
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
                      <SelectItem value="be-fr">Belgique-Français</SelectItem>
                      <SelectItem value="be-nl">België-Nederlands</SelectItem>
                      <SelectItem value="cz">Česká republika</SelectItem>
                      <SelectItem value="dk">Danmark</SelectItem>
                      <SelectItem value="de">Deutschland</SelectItem>
                      <SelectItem value="es">España</SelectItem>
                      <SelectItem value="fr">France</SelectItem>
                      <SelectItem value="it">Italia</SelectItem>
                      <SelectItem value="hu">Magyarország</SelectItem>
                      <SelectItem value="nl">Nederland</SelectItem>
                      <SelectItem value="at">Österreich</SelectItem>
                      <SelectItem value="pl">Polska</SelectItem>
                      <SelectItem value="pt">Portugal</SelectItem>
                      <SelectItem value="ch-de">Schweiz-Deutsch</SelectItem>
                      <SelectItem value="ch-fr">Suisse-Français</SelectItem>
                      <SelectItem value="se">Sverige</SelectItem>
                      <SelectItem value="ch-it">Svizzera-Italiano</SelectItem>
                      <SelectItem value="uk">United Kingdom</SelectItem>
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
                      placeholder="e.g. reggiseno riduttore, non-wired bra..."
                      {...field}
                      disabled={form.watch("autoDetectCategory")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
          </div>

          <FormField
            control={form.control}
            name="autoDetectCategory"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="cursor-pointer">
                    Auto-detect category from image
                  </FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Let AI automatically identify the product category
                  </p>
                </div>
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="articleNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Article Number</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g. 10222554"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ean"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>EAN</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g. 7613112064513"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="composition"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Composition</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="e.g. 53% Polyamid, 47% Elastan"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="certifications"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Certifications</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="e.g. OEKO-TEX® STANDARD 100, 22.0.22419 Hohenstein HTTI"
                    className="resize-none"
                    rows={2}
                    {...field}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Separate multiple certifications with commas
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end">
            <Button 
              type="submit" 
              size="sm"
              disabled={!form.formState.isValid}
            >
              Apply Settings
            </Button>
          </div>
        </form>
      </Form>
    </Card>
  );
}