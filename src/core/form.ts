import forms from "~/components/Forms";

export default function createForm(name: string) {
    const resolver = forms({name});

    return resolver;
}


