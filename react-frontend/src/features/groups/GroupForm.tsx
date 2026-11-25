import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/common/PageHeader';
import { ParentGroupSelect, type ParentOption } from './ParentGroupSelect';

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  parentId: z.string().nullable(),
});

export type GroupFormValues = z.infer<typeof schema>;

export interface GroupFormProps {
  /** Page title, such as "Create role group". */
  title: string;
  /** One line under the title. */
  description: string;
  /** Where Back and Cancel go: the group list. */
  backHref: string;
  /** The Back link's text, such as "Role groups". */
  backLabel: string;
  /** Help under the Name field. */
  nameHelp: string;
  /** Groups this group may sit under: never itself or its descendants. */
  parentOptions: ParentOption[];
  initialValues?: GroupFormValues;
  submitLabel: string;
  /** Saves the group. A rejection keeps the form open for another try. */
  onSubmit: (values: GroupFormValues) => Promise<void>;
}

/** The create and edit form for a role group or a permission group. */
export function GroupForm({
  title,
  description,
  backHref,
  backLabel,
  nameHelp,
  parentOptions,
  initialValues = { name: '', parentId: null },
  submitLabel,
  onSubmit,
}: GroupFormProps) {
  const [saving, setSaving] = useState(false);
  const form = useForm<GroupFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  });

  const submit = form.handleSubmit(async (values) => {
    setSaving(true);
    try {
      await onSubmit({ name: values.name.trim(), parentId: values.parentId });
    } catch {
      // The caller has shown the error; the form stays as typed.
    } finally {
      setSaving(false);
    }
  });

  // Laid out as `groups-form.dc.html` draws it: the content is left-aligned in
  // a 1120px column with a 640px card, and Cancel and Save sit in a footer bar
  // that spans the page and sticks to the bottom of the window. The negative
  // margins pull the bar out to the edges of the shell's padded main area.
  return (
    <Form {...form}>
      <form
        onSubmit={submit}
        noValidate
        className="flex min-h-[calc(100vh-6.5rem)] flex-col sm:min-h-[calc(100vh-7.5rem)] lg:min-h-[calc(100vh-8rem)]"
      >
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
          <div className="flex flex-col gap-3">
            <Link
              to={backHref}
              className="text-foreground-secondary hover:text-foreground inline-flex w-fit items-center gap-1 text-[13px] font-medium"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              {backLabel}
            </Link>
            <PageHeader title={title} description={description} />
          </div>

          <div className="bg-card flex max-w-[640px] flex-col gap-5 rounded-xl border p-7">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormDescription>{nameHelp}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent group</FormLabel>
                  <FormControl>
                    <ParentGroupSelect
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      options={parentOptions}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="bg-background sticky bottom-0 z-10 mt-auto -mr-4 -mb-4 -ml-4 flex justify-center border-t px-4 py-3.5 sm:-mr-6 sm:-mb-6 sm:-ml-6 sm:px-6 lg:-mr-8 lg:-mb-8 lg:-ml-8 lg:px-8">
          <div className="flex w-full max-w-[1120px] justify-end gap-2">
            <Button asChild variant="outline">
              <Link to={backHref}>Cancel</Link>
            </Button>
            <Button
              type="submit"
              disabled={saving}
              aria-busy={saving || undefined}
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
